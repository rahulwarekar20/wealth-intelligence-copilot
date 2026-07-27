import boto3
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