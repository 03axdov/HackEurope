import os
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

from .models import Incident, PullRequest
from .serializers import IncidentSerializer, PullRequestSerializer


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
    prompt = f"When calling the following HTTP target: '{incident.get("httpTarget")}' "
    prompt += " it is slow. The following queries are called: \n"

    slowCallOperation = incident.get("callOperations")[0]
    for i, query in enumerate(slowCallOperation.get("queries")):
        prompt += f"{i+1}: {query}\n"

    prompt += "With the following args: " + slowCallOperation.get("callOperation").get("args") + ". "
    prompt += f"It is called from the following file: {slowCallOperation.get("callOperation").get("tag")}. "

    prompt += f"For further info, here is the stacktrace: {incident.get("stacktrace")}. "
    prompt += f"Try to improve performance regarding these queries without changing behaviour. "
    return prompt


from collections import defaultdict
def detect_incidents():

    jaeger_base_url = os.getenv("JAEGER_BASE_URL", "http://localhost:16686").rstrip("/")

    services_response = requests.get(
        f"{jaeger_base_url}/api/services",
        timeout=30,
    )
    if not services_response.ok:
        raise RuntimeError(
            f"Failed to fetch services from Jaeger ({services_response.status_code}): {services_response.text}"
        )

    services_payload = services_response.json()
    services = services_payload.get("data", []) if isinstance(services_payload, dict) else []
    if not isinstance(services, list):
        services = []

    all_traces = []
    for service_name in services:
        traces_response = requests.get(
            f"{jaeger_base_url}/api/traces",
            params={"service": service_name, "limit": 0},
            timeout=30,
        )
        if not traces_response.ok:
            raise RuntimeError(
                f"Failed to fetch traces for service '{service_name}' "
                f"({traces_response.status_code}): {traces_response.text}"
            )

        traces_payload = traces_response.json()
        traces = traces_payload.get("data", []) if isinstance(traces_payload, dict) else []
        if isinstance(traces, list):
            all_traces.extend(traces)

    incidents = {}
    for trace in all_traces:
        getSpan = None
        callOperations = {}
        dbQuerySpan = None
        callOperationSpans = defaultdict(list)

        for span in trace.get("spans"):
            if span.get("operationName") == "GET":
                getSpan = span
            if span.get("operationName") == "prisma:call-operation":
                callOperations[span.get("spanID")] = span
            if span.get("operationName") == "prisma:client:db_query":
                dbQuerySpan = span
                references = dbQuerySpan.get("references")
                firstReference = references[0]
                spanId = firstReference.get("spanID")
                
                for tag in dbQuerySpan.get("tags"):
                    if tag.get("key") == "db.query.text":
                        callOperationSpans[spanId].append(tag.get("value"))

        if not getSpan or len(callOperations) == 0 or not dbQuerySpan:
            continue

        duration = getSpan.get("duration")
        if duration < 2 * 10**6:
            continue

        httpTarget = None
        stacktrace = None
        for tag in getSpan.get("tags"):
            if tag.get("key") == "http.target":
                httpTarget = tag
            if tag.get("key") == "code.stacktrace":
                stacktrace = tag

        for span_id in callOperations:
            curr = {"duration": callOperations[span_id].get("duration")}
            for tag in callOperations[span_id].get("tags"):
                if tag.get("key") == "prisma.args":
                    curr["args"] = tag.get("value")
                if tag.get("key") == "prisma.frame":
                    curr["tag"] = tag.get("value")
                
            callOperations[span_id] = curr

        print(callOperations)
        
        incidents[trace.get("traceID")] = {
            "httpTarget": httpTarget.get("value"),
            "stacktrace": stacktrace.get("value"),
            "duration": duration,
            "callOperations": sorted([{
                "callOperation": callOperations[span_id],
                "queries": sorted(callOperationSpans[span_id])
            } for span_id in callOperations], key=lambda co: co.get("callOperation").get("duration"), reverse=True)
        }

    
    for trace_id in incidents:
       incident_data = incidents[trace_id]
       prompt = create_prompt_from_incident(incident_data)
       print("GENERATING PR")
       pull_request = generate_pr("https://github.com/03axdov/HackEurope", prompt=prompt)

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

           Incident.objects.create(
               pullRequest_id=pull_request["id"],
               title=incident_fields.get("title") or f"Slow endpoint detected: {http_target}",
               problemDescription=incident_fields.get("problemDescription") or (
                   f"Slow HTTP request detected for '{http_target}' in trace {trace_id}. "
                   f"Observed duration: {duration_micros / 1_000_000:.3f} seconds."
               ),
               solutionDescription=incident_fields.get("solutionDescription") or (
                   "A pull request was generated to improve performance. "
                   + (f"Primary related queries: {', '.join(top_queries)}" if top_queries else "No query details captured.")
               ),
               timeImpact=float(duration_micros) / 1_000_000,
               impactCount=len(call_ops),
           )
        

    return incidents
