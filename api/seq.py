import requests

TURNSTILE_SECRET = "1x0000000000000000000000000000000AA"

def sequrity_check(token):
    url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

    if not token:
        return False

    try:
        response = requests.post(
            url,
            data={
                "secret": TURNSTILE_SECRET,
                "response": token
            },
            timeout=10
        )

        response.raise_for_status()
        result = response.json()

        print("Cloudflare response:", result)

        return result.get("success") is True

    except (requests.RequestException, ValueError) as e:
        print("Turnstile verification error:", e)
        return False