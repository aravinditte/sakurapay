from locust import HttpUser, task
class SakuraUser(HttpUser):
    @task
    def health(self): self.client.get('/health/live')
