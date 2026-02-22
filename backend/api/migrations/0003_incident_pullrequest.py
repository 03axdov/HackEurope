from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0002_incident"),
    ]

    operations = [
        migrations.AddField(
            model_name="incident",
            name="pullRequest",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="incidents",
                to="api.pullrequest",
            ),
        ),
    ]
