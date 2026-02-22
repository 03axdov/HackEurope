from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0003_incident_pullrequest"),
    ]

    operations = [
        migrations.CreateModel(
            name="Log",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "run_id",
                    models.CharField(
                        db_index=True,
                        help_text="Groups log entries from a single detect_incidents execution.",
                        max_length=64,
                    ),
                ),
                (
                    "source",
                    models.CharField(
                        db_index=True,
                        default="detect_incidents",
                        help_text="Origin of the log entry (for example detect_incidents).",
                        max_length=64,
                    ),
                ),
                (
                    "step",
                    models.CharField(
                        db_index=True,
                        help_text="High-level step name, e.g. fetch_services, analyze_trace, generate_pr.",
                        max_length=128,
                    ),
                ),
                (
                    "level",
                    models.CharField(
                        choices=[("info", "Info"), ("warning", "Warning"), ("error", "Error")],
                        db_index=True,
                        default="info",
                        max_length=16,
                    ),
                ),
                (
                    "message",
                    models.TextField(help_text="Human-readable summary of what the agent examined or did."),
                ),
                (
                    "context",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Structured details used during detection (trace IDs, endpoints, durations, etc.).",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                (
                    "incident",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="logs",
                        to="api.incident",
                    ),
                ),
                (
                    "pull_request",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="logs",
                        to="api.pullrequest",
                    ),
                ),
            ],
            options={
                "ordering": ("-created_at", "-id"),
            },
        ),
    ]
