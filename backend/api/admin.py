from django.contrib import admin
from .models import PullRequest


@admin.register(PullRequest)
class PullRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "repo_owner", "repo_name", "title", "base_branch", "head_branch", "created_at")
    search_fields = ("repo_owner", "repo_name", "title", "base_branch", "head_branch")
