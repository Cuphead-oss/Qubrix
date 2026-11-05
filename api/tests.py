# from django.test import TestCase

# Create your tests here.
# import requests
# import os

# url = "https://www.fast2sms.com/dev/bulkV2"

# headers = {
# "authorization":"qxsepUcw8wV3JufxiVRlTOIUjbgvffHOB2MumLLn3b6aS8qaoiVBiTjL8E9dbGJqx3JofSdjAfupmA25",
# "Content-Type":"application/json"

# }

# payload = {
# "route" : "q",
# "message" : "Test message",
# "numbers" : "8850410674",
# }

# response = requests.post(
#     url,
#     headers=headers,
#     json=payload
# )

# print(response.status_code)
# print(response.text)

import secrets

def generate_secure_otp(length=6):
    # Generates a string of secure random digits
    return "".join(secrets.choice("0123456789") for _ in range(length))

# Generate a 6-digit secure OTP
otp = generate_secure_otp(6)
print(f"Your secure OTP is: {otp}")
