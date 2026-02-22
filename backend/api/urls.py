from rest_framework.routers import DefaultRouter
from .views import IncidentViewSet, LogViewSet, PullRequestViewSet


router = DefaultRouter()
router.register(r"pull-requests", PullRequestViewSet, basename="pull-request")
router.register(r"incidents", IncidentViewSet, basename="incident")
router.register(r"logs", LogViewSet, basename="log")

urlpatterns = router.urls
