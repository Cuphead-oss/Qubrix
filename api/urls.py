from rest_framework.routers import SimpleRouter
from .views import generateCode, valdiateOtp

router = SimpleRouter()

router.register(
    r'generateCode',
    generateCode,
    basename='generate-code'
)

router.register(
    r'valdiateOtp',
    valdiateOtp,
    basename='validate-otp'
)

urlpatterns = router.urls