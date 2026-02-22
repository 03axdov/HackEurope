from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0007_detectionrun"),
    ]

    operations = [
        migrations.AddField(
            model_name="detectionrun",
            name="errorMessage",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="detectionrun",
            name="status",
            field=models.CharField(
                choices=[("success", "Success"), ("failure", "Failure")],
                db_index=True,
                default="success",
                max_length=16,
            ),
        ),
    ]
