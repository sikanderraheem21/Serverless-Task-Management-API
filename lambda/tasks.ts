import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand, QueryCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const dynamo = new DynamoDBClient({});
const tableName = process.env.TABLE_NAME || '';

function getUserId(event: APIGatewayProxyEvent): string {
  const claims = event.requestContext.authorizer?.claims;
  if (!claims) throw new Error("Unauthorized");
  return claims.sub; // Cognito user ID
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);

    if (event.httpMethod === 'GET') {
      const result = await dynamo.send(new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: {
          ':uid': { S: userId }
        }
      }));

      const tasks = result.Items?.map(item => ({
        taskId: item.taskId.S,
        title: item.title.S,
        completed: item.completed.BOOL
      })) || [];

      return {
        statusCode: 200,
        body: JSON.stringify({ tasks }),
      };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const taskId = uuidv4();
      const title = body.title || 'Untitled';

      await dynamo.send(new PutItemCommand({
        TableName: tableName,
        Item: {
          userId: { S: userId },
          taskId: { S: taskId },
          title: { S: title },
          completed: { BOOL: false }
        }
      }));

      return {
        statusCode: 201,
        body: JSON.stringify({ message: 'Task created', taskId }),
      };
    }

    if (event.httpMethod === 'DELETE') {
      const taskId = event.queryStringParameters?.taskId;
      if (!taskId) {
        return { statusCode: 400, body: 'taskId is required in query string' };
      }

      await dynamo.send(new DeleteItemCommand({
        TableName: tableName,
        Key: {
          userId: { S: userId },
          taskId: { S: taskId }
        }
      }));

      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Task deleted' }),
      };
    }

    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };

  } catch (error: any) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server Error', error: error.message }),
    };
  }
};
