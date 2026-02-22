from rest_framework import serializers
from .models import Incident, PullRequest


class PullRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = PullRequest
        fields = [
            "id",
            "repo_owner",
            "repo_name",
            "repo_url",
            "base_branch",
            "head_branch",
            "title",
            "body",
            "compare_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class IncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Incident
        fields = [
            "id",
            "pullRequest",
            "title",
            "problemDescription",
            "solutionDescription",
            "timeImpact",
            "impactCount",
        ]
        read_only_fields = ["id"]
