from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0008_detectionrun_status_errormessage"),
    ]

    operations = [
        migrations.AddField(
            model_name="detectionrun",
            name="incidentCount",
            field=models.IntegerField(default=0),
        ),
    ]
