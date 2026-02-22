from django.contrib import admin
from .models import DetectionRun, Incident, Log, PullRequest


@admin.register(PullRequest)
class PullRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "repo_owner", "repo_name", "title", "base_branch", "head_branch", "created_at")
    search_fields = ("repo_owner", "repo_name", "title", "base_branch", "head_branch")


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "severity", "pullRequest", "timeImpact", "impactCount")
    list_filter = ("severity",)
    search_fields = ("title", "problemDescription", "solutionDescription")


@admin.register(Log)
class LogAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at", "run_id", "source", "step", "level", "incident", "pull_request")
    list_filter = ("source", "step", "level", "created_at")
    search_fields = ("run_id", "message")


@admin.register(DetectionRun)
class DetectionRunAdmin(admin.ModelAdmin):
    list_display = ("id", "date", "runType", "status", "incidentCount")
    list_filter = ("runType", "status", "date")
    search_fields = ("errorMessage",)
