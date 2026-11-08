from django.db import models

# Create your models here.

class Enquiry(models.Model):
    Phone_No=models.CharField(max_length=10)
    Name=models.CharField(max_length=150)
    email=models.EmailField()
    enq=models.TextField()
    submitted_on=models.DateTimeField(auto_now_add=True)