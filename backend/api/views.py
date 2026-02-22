import os
import uuid
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
import requests

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


from agent.agent import generate_pr, generate_incident_fields

from .models import Incident, Log, PullRequest
from .serializers import IncidentSerializer, LogSerializer, PullRequestSerializer


class PullRequestViewSet(viewsets.ModelViewSet):
    queryset = PullRequest.objects.all().order_by("-created_at")
    serializer_class = PullRequestSerializer
    http_method_names = ["get", "post", "head", "options"]


    @action(detail=True, methods=["post"], url_path="merge-pr")
    def merge_pr_from_record(self, request, pk=None):
        record = self.get_object()
        token = os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN")
        if not token:
            return Response(
                {"detail": "Missing GITHUB_TOKEN/GH_TOKEN."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            merged = merge_pr(
                owner=record.repo_owner,
                repo=record.repo_name,
                token=token,
                head=record.head_branch,
                base=record.base_branch,
            )
        except Exception as exc:
            return Response(
                {"detail": f"Failed to merge GitHub PR: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        incident_count = record.incidents.count()
        record.incidents.all().delete()
        deleted_id = record.id
        record.delete()

        return Response(
            {
                "detail": "GitHub PR merged and local PullRequest/Incident records deleted.",
                "deleted_pull_request_id": deleted_id,
                "deleted_incident_count": incident_count,
                "github_merge": merged,
            },
            status=status.HTTP_200_OK,
        )


class IncidentViewSet(viewsets.ModelViewSet):
    queryset = Incident.objects.all().order_by("-id")
    serializer_class = IncidentSerializer

    @action(detail=False, methods=["post"], url_path="detect")
    def detect(self, request):
        try:
            traces = detect_incidents()
        except Exception as exc:
            return Response(
                {"detail": f"Failed to detect incidents: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(
            {"data": traces, "count": len(traces)},
            status=status.HTTP_200_OK,
        )


class LogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LogSerializer

    def get_queryset(self):
        qs = Log.objects.all().order_by("-created_at", "-id")

        params = self.request.query_params
        run_id = params.get("run_id")
        source = params.get("source")
        step = params.get("step")
        level = params.get("level")
        incident_id = params.get("incident")
        pull_request_id = params.get("pull_request")
        limit = params.get("limit")

        if run_id:
            qs = qs.filter(run_id=run_id)
        if source:
            qs = qs.filter(source=source)
        if step:
            qs = qs.filter(step=step)
        if level:
            qs = qs.filter(level=level)
        if incident_id:
            qs = qs.filter(incident_id=incident_id)
        if pull_request_id:
            qs = qs.filter(pull_request_id=pull_request_id)

        if limit:
            try:
                limit_int = max(1, min(int(limit), 1000))
                qs = qs[:limit_int]
            except (TypeError, ValueError):
                pass

        return qs


def merge_pr(owner: str, repo: str, token: str, head: str, base: str):
    auth_headers = [f"Bearer {token}", f"token {token}"]
    last_response = None

    for auth in auth_headers:
        pulls_url = f"https://api.github.com/repos/{owner}/{repo}/pulls"
        list_response = requests.get(
            pulls_url,
            headers={
                "Authorization": auth,
                "Accept": "application/vnd.github+json",
            },
            params={"state": "open", "head": f"{owner}:{head}", "base": base},
            timeout=30,
        )
        last_response = list_response
        if not list_response.ok:
            if list_response.status_code in (401, 403):
                continue
            break

        prs = list_response.json()
        if not isinstance(prs, list) or len(prs) == 0:
            raise RuntimeError(f"No open GitHub PR found for head={head} base={base}.")

        pr_number = prs[0].get("number")
        if not pr_number:
            raise RuntimeError("Could not determine GitHub pull request number to merge.")

        merge_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/merge"
        merge_response = requests.put(
            merge_url,
            headers={
                "Authorization": auth,
                "Accept": "application/vnd.github+json",
            },
            json={"merge_method": "squash"},
            timeout=30,
        )
        last_response = merge_response
        if merge_response.ok:
            return merge_response.json()

        if merge_response.status_code in (401, 403):
            continue
        break

    status = last_response.status_code if last_response is not None else "unknown"
    details = ""
    if last_response is not None:
        try:
            j = last_response.json()
            details = j.get("message", "").strip()
        except Exception:
            details = (last_response.text or "").strip()

    raise RuntimeError(
        "GitHub PR merge failed "
        f"(status={status}). {details or 'No response details.'} "
        "Check token permissions and mergeability."
    )


def create_prompt_from_incident(incident):
    prompt = "You are an expert in optimizing code performance without changing the output of the code.\n"
    prompt += "These are the locations where the slow code is located:\nIn demo2/backend/"

    slowCallOperation = incident.get("callOperations")[0]
    prompt += f"{slowCallOperation.get("callOperation").get("tag")}\n"

    prompt += "Try to keep the performance optimization in this area, but you may move outside of the area if it is necessary to improve performance.\n"
    prompt += "Do not use query raw. Use prisma syntax. It is very important that you identify and fix N+1 queries, while keeping the behavior of the code the same."

    print(prompt)

    return prompt


from collections import defaultdict
def detect_incidents():
    run_id = uuid.uuid4().hex[:12]

    def log_event(step, message, *, level="info", context=None, incident=None, pull_request=None):
        try:
            Log.objects.create(
                run_id=run_id,
                source="detect_incidents",
                step=step,
                level=level,
                message=message,
                context=context or {},
                incident=incident,
                pull_request=pull_request,
            )
        except Exception as exc:
            print(f"Failed to persist detect_incidents log ({step}): {exc}")

    log_event("start", "Starting incident detection run.")

    jaeger_base_url = os.getenv("JAEGER_BASE_URL", "http://localhost:16686").rstrip("/")
    log_event("config", "Using Jaeger base URL.", context={"jaeger_base_url": jaeger_base_url})

    services_response = requests.get(
        f"{jaeger_base_url}/api/services",
        timeout=30,
    )
    if not services_response.ok:
        log_event(
            "fetch_services",
            "Failed to fetch services from Jaeger.",
            level="error",
            context={"status_code": services_response.status_code, "response_text": services_response.text[:1000]},
        )
        raise RuntimeError(
            f"Failed to fetch services from Jaeger ({services_response.status_code}): {services_response.text}"
        )

    services_payload = services_response.json()
    services = services_payload.get("data", []) if isinstance(services_payload, dict) else []
    if not isinstance(services, list):
        services = []
        log_event("fetch_services", "Services payload had unexpected shape; defaulted to empty list.", level="warning")
    else:
        log_event("fetch_services", "Fetched services from Jaeger.", context={"service_count": len(services)})

    all_traces = []
    for service_name in services:
        traces_response = requests.get(
            f"{jaeger_base_url}/api/traces",
            params={"service": service_name, "limit": 0},
            timeout=30,
        )
        if not traces_response.ok:
            log_event(
                "fetch_traces",
                "Failed to fetch traces for service.",
                level="error",
                context={
                    "service_name": service_name,
                    "status_code": traces_response.status_code,
                    "response_text": traces_response.text[:1000],
                },
            )
            raise RuntimeError(
                f"Failed to fetch traces for service '{service_name}' "
                f"({traces_response.status_code}): {traces_response.text}"
            )

        traces_payload = traces_response.json()
        traces = traces_payload.get("data", []) if isinstance(traces_payload, dict) else []
        if isinstance(traces, list):
            all_traces.extend(traces)
            log_event(
                "fetch_traces",
                "Fetched traces for service.",
                context={"service_name": service_name, "trace_count": len(traces)},
            )
        else:
            log_event(
                "fetch_traces",
                "Traces payload had unexpected shape for service; skipping.",
                level="warning",
                context={"service_name": service_name},
            )

    log_event("fetch_traces", "Completed Jaeger trace fetch for all services.", context={"total_trace_count": len(all_traces)})

    incidents = {}
    created_incident_candidates = {}
    skipped_missing_structure = 0
    skipped_fast = 0
    for trace in all_traces:
        # getSpan = None
        callOperations = {}
        # dbQuerySpan = None
        callOperationSpans = defaultdict(list)

        spans = trace.get("spans") or []
        if not isinstance(spans, list):
            log_event(
                "analyze_trace",
                "Trace missing spans list; skipping.",
                level="warning",
                context={"trace_id": trace.get("traceID")},
            )
            skipped_missing_structure += 1
            continue

        duration = 0
        for span in spans:
            if span.get("duration") > duration:
                duration = span.get("duration")
            # if not span.get("references"):
            #     rootSpan = span
            # if span.get("operationName") == "GET":
            #     getSpan = span
            if span.get("operationName") == "prisma:call-operation":
                callOperations[span.get("spanID")] = span
            # if span.get("operationName") == "prisma:client:db_query":
            #     dbQuerySpan = span
            #     references = dbQuerySpan.get("references") or []
            #     if not references:
            #         continue
            #     firstReference = references[0]
            #     spanId = firstReference.get("spanID")
                
            #     for tag in dbQuerySpan.get("tags"):
            #         if tag.get("key") == "db.query.text":
            #             callOperationSpans[spanId].append(tag.get("value"))

        if len(callOperations) == 0:
            skipped_missing_structure += 1
            continue

        # duration = rootSpan.get("duration")

        if duration < 2 * 10**6:
            skipped_fast += 1
            continue

        # httpTarget = None
        # stacktrace = None
        # for tag in getSpan.get("tags"):
        #     if tag.get("key") == "http.target":
        #         httpTarget = tag
        #     if tag.get("key") == "code.stacktrace":
        #         stacktrace = tag

        for span_id in callOperations:
            curr = {"duration": callOperations[span_id].get("duration")}
            for tag in callOperations[span_id].get("tags"):
                if tag.get("key") == "prisma.args":
                    curr["args"] = tag.get("value")
                if tag.get("key") == "prisma.frame":
                    curr["tag"] = tag.get("value")
                
            callOperations[span_id] = curr

        # if httpTarget.get("value") == "/matches":
        #     continue
        
        incidents[trace.get("traceID")] = {
            # "httpTarget": httpTarget.get("value") if httpTarget else None,
            # "stacktrace": stacktrace.get("value"),
            "duration": duration,
            "callOperations": sorted([{
                "callOperation": callOperations[span_id],
            } for span_id in callOperations], key=lambda co: co.get("callOperation").get("duration"), reverse=True)
        }
        
        log_event(
            "analyze_trace_output",
            "Detected slow trace candidate.",
            context={
                "trace_id": trace.get("traceID"),
                # "http_target": httpTarget.get("value") if httpTarget else None,
                "duration_micros": duration,
                "call_operation_count": len(callOperations),
            },
        )

    log_event(
        "analyze_trace",
        "Finished analyzing traces.",
        context={
            "candidate_count": len(incidents),
            "skipped_missing_structure": skipped_missing_structure,
            "skipped_fast": skipped_fast,
        },
    )

    
    for trace_id in incidents:
        incident_data = incidents[trace_id]
        prompt = create_prompt_from_incident(incident_data)
        log_event(
            "generate_prompt",
            "Created PR-generation prompt for incident candidate.",
            context={"trace_id": trace_id, "http_target": incident_data.get("httpTarget")},
        )
        print("GENERATING PR")
        try:
            pull_request = generate_pr("https://github.com/didrikmunther/hackeurope-demo.git", prompt=prompt)
        except Exception as exc:
            log_event(
                "generate_pr",
                "Failed to generate pull request suggestion.",
                level="error",
                context={"trace_id": trace_id, "error": str(exc)},
            )
            raise
 
        log_event(
            "generate_pr",
            "Pull request suggestion generation completed.",
            context={
                "trace_id": trace_id,
                "pull_request_id": pull_request.get("id") if isinstance(pull_request, dict) else None,
            },
        )
 
        if isinstance(pull_request, dict) and pull_request.get("id"):
            http_target = incident_data.get("httpTarget") or "unknown target"
            duration_micros = incident_data.get("duration") or 0
            call_ops = incident_data.get("callOperations") or []
            top_queries = []
            if call_ops and isinstance(call_ops, list):
                top_queries = call_ops[0].get("queries") or []
 
            incident_fields = {}
            try:
                incident_fields = generate_incident_fields(
                    detection_prompt=prompt,
                    pull_request_title=str(pull_request.get("title") or ""),
                    pull_request_description=str(pull_request.get("body") or ""),
                )
            except Exception as exc:
                print(f"Failed to generate incident text via Claude; using fallback text. Error: {exc}")
                log_event(
                    "generate_incident_text",
                    "Failed to generate incident text via Claude; using fallback text.",
                    level="warning",
                    context={"trace_id": trace_id, "pull_request_id": pull_request["id"], "error": str(exc)},
                )

            ai_title = str(incident_fields.get("title") or "").strip()
            if ai_title and not ai_title.lower().startswith("for "):
                log_event(
                    "generate_incident_text",
                    "AI returned incident title in unexpected format; using fallback title.",
                    level="warning",
                    context={"trace_id": trace_id, "pull_request_id": pull_request["id"], "title": ai_title},
                )
                ai_title = ""
 
            created_incident = Incident.objects.create(
                pullRequest_id=pull_request["id"],
                url=str(incident_data.get("httpTarget") or ""),
                title=ai_title or "For relevant page caused by slow database queries",
                problemDescription=incident_fields.get("problemDescription") or (
                    f"Slow HTTP request detected for '{http_target}' in trace {trace_id}. "
                    f"Observed duration: {duration_micros / 1_000_000:.3f} seconds."
                ),
                solutionDescription=incident_fields.get("solutionDescription") or (
                    "A pull request was generated to improve performance. "
                    + (f"Primary related queries: {', '.join(top_queries)}" if top_queries else "No query details captured.")
                ),
                severity=incident_fields.get("severity") or "medium",
                timeImpact=round(float(duration_micros) / 1_000_000, 2),
                impactCount=len(call_ops),
            )
            linked_pull_request = PullRequest.objects.filter(id=pull_request["id"]).first()
 
            log_event(
                "create_incident",
                "Created incident linked to suggested pull request.",
                context={
                    "trace_id": trace_id,
                    "http_target": http_target,
                    "duration_micros": duration_micros,
                 },
                incident=created_incident,
                pull_request=linked_pull_request,
             )
            created_incident_candidates[trace_id] = incident_data
        else:
           log_event(
               "generate_pr",
               "PR generation returned no PullRequest record id; skipping incident creation.",
               level="warning",
               context={"trace_id": trace_id},
           )
    
    log_event(
        "complete",
        "Incident detection run completed.",
        context={
            "candidate_count": len(incidents),
            "created_incident_candidates": len(created_incident_candidates),
        },
    )

    return created_incident_candidates
