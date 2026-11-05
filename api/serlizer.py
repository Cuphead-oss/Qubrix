from rest_framework import serializers
from .models import Enquiry

class EnqSerilizer(serializers.ModelSerializer):

    class Meta:
        model=Enquiry
        fields=['Phone_No','Name','email','enq']
    