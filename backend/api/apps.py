from django.apps import AppConfig


class ApiConfig(AppConfig):
    name = 'api'

    def ready(self):
        from .scheduler import start_hourly_detection_scheduler

        start_hourly_detection_scheduler()
