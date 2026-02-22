from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0005_incident_severity"),
    ]

    operations = [
        migrations.AddField(
            model_name="incident",
            name="url",
            field=models.CharField(blank=True, default="", max_length=2048),
        ),
    ]
