from rest_framework import serializers
from .models import PullRequest


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
