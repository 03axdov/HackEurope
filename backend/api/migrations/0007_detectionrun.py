from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0006_incident_url"),
    ]

    operations = [
        migrations.CreateModel(
            name="DetectionRun",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateTimeField(auto_now_add=True, db_index=True)),
                (
                    "runType",
                    models.CharField(
                        choices=[("manual", "Manual"), ("automatic", "Automatic")],
                        db_index=True,
                        max_length=16,
                    ),
                ),
            ],
        ),
    ]
