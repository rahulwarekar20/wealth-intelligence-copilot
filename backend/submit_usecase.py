"""
One-off helper to request AWS Bedrock model access. NOT used by the app
(the app calls Groq). Requires `pip install boto3` and AWS credentials.
Run manually: python submit_usecase.py
"""
import sys

try:
    import boto3
except ImportError:
    sys.exit("boto3 is not installed. Run `pip install boto3` to use this script.")
import base64
import json

client = boto3.client("bedrock", region_name="us-east-1")

data = {
    "companyName": "Personal Project",
    "companyWebsite": "www.github.com",
    "intendedUsers": "1",
    "industryOption": "Financial Services",
    "otherIndustryOption": "",
    "useCases": "Building an AI investment decision support tool for portfolio analysis and financial research"
}

encoded = base64.b64encode(json.dumps(data).encode()).decode()
print("Submitting...")

try:
    response = client.put_use_case_for_model_access(formData=encoded)
    print("SUCCESS:", response)
except Exception as e:
    print("Error:", str(e))