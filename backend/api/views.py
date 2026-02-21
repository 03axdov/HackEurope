from rest_framework import viewsets
from .models import PullRequest
from .serializers import PullRequestSerializer


class PullRequestViewSet(viewsets.ModelViewSet):
    queryset = PullRequest.objects.all().order_by("-created_at")
    serializer_class = PullRequestSerializer
    http_method_names = ["get", "post", "head", "options"]
