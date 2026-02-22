from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0001_pullrequest"),
    ]

    operations = [
        migrations.CreateModel(
            name="Incident",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                ("problemDescription", models.TextField()),
                ("solutionDescription", models.TextField()),
                ("timeImpact", models.FloatField()),
                ("impactCount", models.IntegerField()),
            ],
        ),
    ]
