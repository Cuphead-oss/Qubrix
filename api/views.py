from rest_framework.response import Response
from rest_framework import viewsets
from .serlizer import EnqSerilizer
from rest_framework.permissions import AllowAny
from rest_framework import status
from rest_framework.decorators import action
from .seq import sequrity_check
from django.core.cache import cache
from .serlizer import EnqSerilizer
import requests
import secrets
import os
from qubrix.thor import OtpBurstThrottle, OtpSustainedThrottle
# Create your views here.

def generate_secure_otp(length=6):
    # Generates a string of secure random digits
    return "".join(secrets.choice("0123456789") for _ in range(length))

class generateCode(viewsets.ViewSet):
    throttle_classes=[OtpBurstThrottle,OtpSustainedThrottle]
    permission_classes=[AllowAny]
    
    @action(detail=False,methods=['post'])
    def Sendcode(self,request):
       phone=request.data.get('phone')
       captcha_token = request.data.get('captcha_token')
       seq_check=sequrity_check(captcha_token)
       print(captcha_token,phone,"--------------------->")
       print(seq_check,'<--------------------')
       if seq_check:   
          #Send a code to Phone here for example it is 4002
          #Save it to cache {'Phone':'hash value of opt} limit 5 min
            url = "https://www.fast2sms.com/dev/bulkV2"
          
          
            headers = {
                   "authorization":os.environ.get("FAST2SMS_API_KEY"),
                   "Content-Type":"application/json"
          
                   }
            otp = generate_secure_otp(6)
            payload = {
                   "route" : "q",
                   "message" : f'''Qubrix Associates . Your otp is : {otp}
                                    Valid till 5 min''',
                   "numbers" : phone,
                   }
            response = requests.post(
                      url,
                      headers=headers,
                      json=payload
                   )

            if response.status_code in ['400','401']:
              return Response({'message':'Was not able to Send message'},status=status.HTTP_400_BAD_REQUEST)

            cache.set(phone,otp,timeout=3000)
            return Response({'message':'Sended'},status=status.HTTP_202_ACCEPTED)
       return Response({'message':'unknow'},status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False,methods=['post'])
    def resendCode(self,request):
       throttle_classes=[OtpBurstThrottle,OtpSustainedThrottle]
       phone=request.data.get('phone')
       captcha_token=request.data.get('captcha_token')
       print(phone,captcha_token,'<---------------------------')

       seq_check=sequrity_check(captcha_token)
       if seq_check:   

          url = "https://www.fast2sms.com/dev/bulkV2"
                    
      
          headers = {
               "authorization":os.environ.get("FAST2SMS_API_KEY"),
               "Content-Type":"application/json"
      
            }
          otp = generate_secure_otp(6)
          payload = {
               "route" : "q",
               "message" : f'''Qubrix Associates . Your otp is : {otp}
                                 Valid till 5 min''',
               "numbers" : phone,
               }
          response = requests.post(
                  url,
                  headers=headers,
                  json=payload
               )

          if response.status_code in ['400','401']:
           return Response({'message':'Was not able to Send message'},status=status.HTTP_400_BAD_REQUEST)
          cache.set(phone,otp,timeout=3000)
          #Resends Send a code to Phone here for example it is 4002
          #Save it to cache {'Phone':'hash value of opt} limit 5 min
          return Response({'message':'ReSended'},status=status.HTTP_202_ACCEPTED)
       return Response(status=status.HTTP_400_BAD_REQUEST)

class valdiateOtp(viewsets.ViewSet):
   
   @action(detail=False,methods=['post'])
   def check_otp(self,request):
    otp=request.data.get('otp') 
    phone=request.data.get('phone')
    stored_otp = cache.get(phone)
   

    if stored_otp is None:
       return Response({"message":"Otp expired"},status=status.HTTP_406_NOT_ACCEPTABLE)

    if str(stored_otp)==str(otp):
       request.session.create()  
       cache.set(request.session.session_key,{'verfyied':True},timeout= 600)
      #  cache.delete(phone)
       return Response({'message':True},status=status.HTTP_202_ACCEPTED)
    
    return Response({'message':False},status=status.HTTP_406_NOT_ACCEPTABLE)

   @action(detail=False,methods=['post'])
   def submitenquiry(self,request):
      print('<---------------------------submited to end point')
      key=request.session.session_key
      cache_=cache.get(key)
      if cache is None:
         return Response({"message":False},status=status.HTTP_400_BAD_REQUEST)
      phone=request.data.get('phone')
      name=request.data.get('name')
      email=request.data.get('email')
      message=request.data.get('message')
      data_={'Phone_No':phone,'Name':name,'email':email,'enq':message}
      ser=EnqSerilizer(data=data_)

      if ser.is_valid():
         ser.save()
         print(ser.data)
      cache_=cache.get(request.session.session_key)
      print(cache_)
      return Response({'message':'Ok'})      