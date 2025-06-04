#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ServerlessCdkProjectStack } from '../lib/serverless_cdk_project-stack';

const app = new cdk.App();
new ServerlessCdkProjectStack(app, 'ServerlessCdkProjectStack', {
});