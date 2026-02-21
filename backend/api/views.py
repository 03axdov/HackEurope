import os
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
import requests

from .models import PullRequest
from .serializers import PullRequestSerializer


class PullRequestViewSet(viewsets.ModelViewSet):
    queryset = PullRequest.objects.all().order_by("-created_at")
    serializer_class = PullRequestSerializer
    http_method_names = ["get", "post", "head", "options"]

    @action(detail=True, methods=["post"], url_path="create-pr")
    def create_pr_from_record(self, request, pk=None):
        record = self.get_object()
        token = os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN")
        if not token:
            return Response(
                {"detail": "Missing GITHUB_TOKEN/GH_TOKEN."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            created = create_pr(
                owner=record.repo_owner,
                repo=record.repo_name,
                token=token,
                head=record.head_branch,
                base=record.base_branch,
                title=record.title,
                body=record.body,
            )
        except Exception as exc:
            return Response(
                {"detail": f"Failed to create GitHub PR: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        deleted_id = record.id
        record.delete()
        return Response(
            {
                "detail": "GitHub PR created and local record deleted.",
                "deleted_id": deleted_id,
                "github_pr": created,
            },
            status=status.HTTP_200_OK,
        )


def create_pr(owner: str, repo: str, token: str, head: str, base: str, title: str, body: str):
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls"
    payload = {"title": title, "head": head, "base": base, "body": body}
    auth_headers = [f"Bearer {token}", f"token {token}"]
    last_response = None

    for auth in auth_headers:
        r = requests.post(
            url,
            headers={
                "Authorization": auth,
                "Accept": "application/vnd.github+json",
            },
            json=payload,
            timeout=30,
        )
        last_response = r
        if r.ok:
            return r.json()

        # Retry with alternate auth header format only for auth-style failures.
        if r.status_code not in (401, 403):
            break

    status = last_response.status_code if last_response is not None else "unknown"
    details = ""
    if last_response is not None:
        try:
            j = last_response.json()
            message = j.get("message", "").strip()
            errors = j.get("errors")
            if errors:
                details = f"{message}; errors={errors}"
            else:
                details = message
        except Exception:
            details = (last_response.text or "").strip()

    raise RuntimeError(
        "GitHub PR creation failed "
        f"(status={status}). {details or 'No response details.'} "
        "Check token permissions for this repo (Pull requests: Read and write)."
    )
