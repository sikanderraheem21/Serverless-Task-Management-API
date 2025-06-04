import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';

export class ServerlessCdkProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 6,
        requireDigits: true,
        requireLowercase: true,
      },
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    // 2. DynamoDB Table
    const tasksTable = new dynamodb.Table(this, 'TasksTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'taskId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Not for production
    });

    // 3. Lambda Function (for /tasks GET, POST)
    const tasksLambda = new NodejsFunction(this, 'TasksLambda', {
    entry: 'lambda/tasks.ts', 
    handler: 'handler',
    runtime: lambda.Runtime.NODEJS_18_X,
    environment: {TABLE_NAME: tasksTable.tableName,}, });

    tasksTable.grantReadWriteData(tasksLambda);

    // 4. API Gateway + Cognito Authorizer
    const api = new apigateway.RestApi(this, 'TasksApi', {
      restApiName: 'Task Management Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
    });

    const tasksResource = api.root.addResource('tasks');

    tasksResource.addMethod('GET', new apigateway.LambdaIntegration(tasksLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    tasksResource.addMethod('POST', new apigateway.LambdaIntegration(tasksLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Output values (e.g., for testing or frontend)
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'ApiEndpoint', { value: api.url });
  }
}
