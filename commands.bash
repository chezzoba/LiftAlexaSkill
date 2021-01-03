aws s3 mb s3://alexaliftskill/

sam package --s3-bucket alexaliftskill --template-file template.yaml --output-template-file gen/cloudformationtemplate.yaml

sam deploy --template-file gen/cloudformationtemplate.yaml --stack-name AlexaLiftSkill --region us-east-1 --capabilities CAPABILITY_IAM

cd src && zip -r ../src.zip * && cd .. && 
aws s3 cp src.zip s3://alexaliftskill/source.zip && 
aws lambda update-function-code --function-name AlexaLiftSkill-AlexaFunction-6KTNZZ29KHBS --s3-bucket alexaliftskill --s3-key source.zip