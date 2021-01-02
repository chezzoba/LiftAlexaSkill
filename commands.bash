aws s3 mb s3://alexaliftskill/

sam package --s3-bucket alexaliftskill --template-file template.yaml --output-template-file gen/cloudformationtemplate.yaml

sam deploy --template-file gen/cloudformationtemplate.yaml --stack-name AlexaLiftSkill --region us-east-1 --capabilities CAPABILITY_IAM


aws s3 cp src/src.zip s3://alexaliftskill/source.zip
aws lambda update-function-code --function-name AlexaLiftSkill-AlexaFunction-1UOTFQ575R74N --s3-bucket alexaliftskill --s3-key source.zip