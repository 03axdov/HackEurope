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
