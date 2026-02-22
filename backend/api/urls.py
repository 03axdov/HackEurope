from rest_framework.routers import DefaultRouter
from .views import IncidentViewSet, PullRequestViewSet


router = DefaultRouter()
router.register(r"pull-requests", PullRequestViewSet, basename="pull-request")
router.register(r"incidents", IncidentViewSet, basename="incident")

urlpatterns = router.urls
