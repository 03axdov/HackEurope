from rest_framework.routers import DefaultRouter
from .views import PullRequestViewSet


router = DefaultRouter()
router.register(r"pull-requests", PullRequestViewSet, basename="pull-request")

urlpatterns = router.urls
