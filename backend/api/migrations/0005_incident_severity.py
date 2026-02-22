from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0004_log"),
    ]

    operations = [
        migrations.AddField(
            model_name="incident",
            name="severity",
            field=models.CharField(
                choices=[
                    ("low", "Low"),
                    ("medium", "Medium"),
                    ("high", "High"),
                    ("critical", "Critical"),
                    ("blocker", "Blocker"),
                ],
                db_index=True,
                default="medium",
                max_length=16,
            ),
        ),
    ]
