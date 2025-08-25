# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - button "Toggle Menu" [ref=e6] [cursor=pointer]:
            - img [ref=e7] [cursor=pointer]
          - generic [ref=e8]: SolarERP
        - link "Sign in" [ref=e10] [cursor=pointer]:
          - /url: /auth/signin
    - main [ref=e11]:
      - generic [ref=e12]:
        - heading "Sign in" [level=1] [ref=e13]
        - generic [ref=e14]:
          - generic [ref=e15]:
            - generic [ref=e16]: Email
            - textbox "you@example.com" [ref=e17]
            - button "Send magic link" [disabled] [ref=e18]
          - generic [ref=e19]:
            - generic [ref=e20]: Phone (WhatsApp/SMS)
            - textbox "91XXXXXXXXXX" [ref=e21]
            - button "Send OTP" [disabled] [ref=e22]
  - status [ref=e23]:
    - generic [ref=e24]:
      - img [ref=e26]
      - generic [ref=e28]:
        - text: Static route
        - button "Hide static indicator" [ref=e29] [cursor=pointer]:
          - img [ref=e30] [cursor=pointer]
  - alert [ref=e33]
```