from django.db import models


class PullRequest(models.Model):
    repo_owner = models.CharField(max_length=255)
    repo_name = models.CharField(max_length=255)
    repo_url = models.URLField()
    base_branch = models.CharField(max_length=255)
    head_branch = models.CharField(max_length=255)
    title = models.CharField(max_length=255)
    body = models.TextField()
    compare_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.repo_owner}/{self.repo_name}#{self.id}: {self.title}"


class Incident(models.Model):
    SEVERITY_CHOICES = (
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("critical", "Critical"),
        ("blocker", "Blocker"),
    )

    pullRequest = models.ForeignKey(
        PullRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="incidents",
    )
    url = models.CharField(max_length=2048, blank=True, default="")
    title = models.CharField(max_length=255)
    problemDescription = models.TextField()
    solutionDescription = models.TextField()
    timeImpact = models.FloatField()
    impactCount = models.IntegerField()
    severity = models.CharField(max_length=16, choices=SEVERITY_CHOICES, default="medium", db_index=True)

    def __str__(self) -> str:
        return self.title


class Log(models.Model):
    LEVEL_CHOICES = (
        ("info", "Info"),
        ("warning", "Warning"),
        ("error", "Error"),
    )

    run_id = models.CharField(
        max_length=64,
        db_index=True,
        help_text="Groups log entries from a single detect_incidents execution.",
    )
    source = models.CharField(
        max_length=64,
        default="detect_incidents",
        db_index=True,
        help_text="Origin of the log entry (for example detect_incidents).",
    )
    step = models.CharField(
        max_length=128,
        db_index=True,
        help_text="High-level step name, e.g. fetch_services, analyze_trace, generate_pr.",
    )
    level = models.CharField(max_length=16, choices=LEVEL_CHOICES, default="info", db_index=True)
    message = models.TextField(help_text="Human-readable summary of what the agent examined or did.")
    context = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured details used during detection (trace IDs, endpoints, durations, etc.).",
    )
    incident = models.ForeignKey(
        Incident,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="logs",
    )
    pull_request = models.ForeignKey(
        PullRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="logs",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("-created_at", "-id")

    def __str__(self) -> str:
        return f"[{self.source}:{self.step}] {self.message[:80]}"
