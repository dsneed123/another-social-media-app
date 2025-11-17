# relays.social - AWS Production Deployment Guide

## Overview
This guide covers deploying relays.social to AWS using:
- **ECS Fargate** for containerized backend
- **RDS PostgreSQL** for database
- **ElastiCache Redis** for caching
- **Application Load Balancer** for HTTPS/SSL
- **CloudFront + R2** for media CDN
- **Route 53** for DNS

## Prerequisites
- AWS Account with billing enabled
- AWS CLI installed and configured
- Docker installed locally
- Domain name (relays.social)

## Architecture

```
                    [Route 53]
                        ↓
              [CloudFront CDN] ← [R2 Storage]
                        ↓
            [Application Load Balancer]
                    ↓    ↓
              [ECS Fargate Tasks]
                ↙         ↘
    [RDS PostgreSQL]  [ElastiCache Redis]
```

## Step 1: Set Up VPC and Networking

### Create VPC
```bash
aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=relays-vpc}]'
```

### Create Subnets (2 public, 2 private for HA)
```bash
# Public Subnet 1 (us-east-1a)
aws ec2 create-subnet \
  --vpc-id <VPC_ID> \
  --cidr-block 10.0.1.0/24 \
  --availability-zone us-east-1a

# Public Subnet 2 (us-east-1b)
aws ec2 create-subnet \
  --vpc-id <VPC_ID> \
  --cidr-block 10.0.2.0/24 \
  --availability-zone us-east-1b

# Private Subnet 1 (us-east-1a)
aws ec2 create-subnet \
  --vpc-id <VPC_ID> \
  --cidr-block 10.0.10.0/24 \
  --availability-zone us-east-1a

# Private Subnet 2 (us-east-1b)
aws ec2 create-subnet \
  --vpc-id <VPC_ID> \
  --cidr-block 10.0.11.0/24 \
  --availability-zone us-east-1b
```

### Create Internet Gateway
```bash
aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=relays-igw}]'

aws ec2 attach-internet-gateway \
  --vpc-id <VPC_ID> \
  --internet-gateway-id <IGW_ID>
```

## Step 2: Set Up RDS PostgreSQL

### Create DB Subnet Group
```bash
aws rds create-db-subnet-group \
  --db-subnet-group-name relays-db-subnet \
  --db-subnet-group-description "Subnet group for relays.social database" \
  --subnet-ids <PRIVATE_SUBNET_1_ID> <PRIVATE_SUBNET_2_ID>
```

### Create Security Group for RDS
```bash
aws ec2 create-security-group \
  --group-name relays-rds-sg \
  --description "Security group for RDS PostgreSQL" \
  --vpc-id <VPC_ID>

aws ec2 authorize-security-group-ingress \
  --group-id <RDS_SG_ID> \
  --protocol tcp \
  --port 5432 \
  --source-group <ECS_SG_ID>
```

### Create RDS Instance
```bash
aws rds create-db-instance \
  --db-instance-identifier relays-postgres \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --engine-version 16.1 \
  --master-username relayhub_admin \
  --master-user-password <STRONG_PASSWORD> \
  --allocated-storage 20 \
  --storage-type gp3 \
  --db-subnet-group-name relays-db-subnet \
  --vpc-security-group-ids <RDS_SG_ID> \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "mon:04:00-mon:05:00" \
  --enable-performance-insights \
  --publicly-accessible false \
  --storage-encrypted
```

## Step 3: Set Up ElastiCache Redis

### Create Cache Subnet Group
```bash
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name relays-cache-subnet \
  --cache-subnet-group-description "Subnet group for relays.social cache" \
  --subnet-ids <PRIVATE_SUBNET_1_ID> <PRIVATE_SUBNET_2_ID>
```

### Create Security Group for Redis
```bash
aws ec2 create-security-group \
  --group-name relays-redis-sg \
  --description "Security group for Redis" \
  --vpc-id <VPC_ID>

aws ec2 authorize-security-group-ingress \
  --group-id <REDIS_SG_ID> \
  --protocol tcp \
  --port 6379 \
  --source-group <ECS_SG_ID>
```

### Create Redis Cluster
```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id relays-redis \
  --engine redis \
  --engine-version 7.1 \
  --cache-node-type cache.t4g.micro \
  --num-cache-nodes 1 \
  --cache-subnet-group-name relays-cache-subnet \
  --security-group-ids <REDIS_SG_ID> \
  --snapshot-retention-limit 5 \
  --snapshot-window "03:00-05:00"
```

## Step 4: Set Up ECR (Container Registry)

### Create ECR Repository
```bash
aws ecr create-repository \
  --repository-name relays-social/backend \
  --image-scanning-configuration scanOnPush=true
```

### Build and Push Docker Image
```bash
# Get ECR login
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# Build image
cd backend
docker build -t relays-social/backend .

# Tag image
docker tag relays-social/backend:latest <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/relays-social/backend:latest

# Push image
docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/relays-social/backend:latest
```

## Step 5: Set Up ECS Fargate

### Create ECS Cluster
```bash
aws ecs create-cluster \
  --cluster-name relays-cluster \
  --capacity-providers FARGATE FARGATE_SPOT
```

### Create Task Execution Role
```bash
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document file://ecs-task-execution-role-trust-policy.json

aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

### Create Task Definition
See `ecs-task-definition.json` (created separately)

### Register Task Definition
```bash
aws ecs register-task-definition \
  --cli-input-json file://ecs-task-definition.json
```

## Step 6: Set Up Application Load Balancer

### Create Security Group for ALB
```bash
aws ec2 create-security-group \
  --group-name relays-alb-sg \
  --description "Security group for ALB" \
  --vpc-id <VPC_ID>

# Allow HTTPS
aws ec2 authorize-security-group-ingress \
  --group-id <ALB_SG_ID> \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# Allow HTTP (redirect to HTTPS)
aws ec2 authorize-security-group-ingress \
  --group-id <ALB_SG_ID> \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0
```

### Create ALB
```bash
aws elbv2 create-load-balancer \
  --name relays-alb \
  --subnets <PUBLIC_SUBNET_1_ID> <PUBLIC_SUBNET_2_ID> \
  --security-groups <ALB_SG_ID> \
  --scheme internet-facing \
  --type application
```

### Create Target Group
```bash
aws elbv2 create-target-group \
  --name relays-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id <VPC_ID> \
  --target-type ip \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3
```

### Request SSL Certificate (ACM)
```bash
aws acm request-certificate \
  --domain-name relays.social \
  --subject-alternative-names www.relays.social api.relays.social \
  --validation-method DNS
```

### Create HTTPS Listener
```bash
aws elbv2 create-listener \
  --load-balancer-arn <ALB_ARN> \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=<CERTIFICATE_ARN> \
  --default-actions Type=forward,TargetGroupArn=<TARGET_GROUP_ARN>
```

## Step 7: Create ECS Service

```bash
aws ecs create-service \
  --cluster relays-cluster \
  --service-name relays-backend \
  --task-definition relays-backend:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --platform-version LATEST \
  --network-configuration "awsvpcConfiguration={subnets=[<PRIVATE_SUBNET_1_ID>,<PRIVATE_SUBNET_2_ID>],securityGroups=[<ECS_SG_ID>],assignPublicIp=DISABLED}" \
  --load-balancers targetGroupArn=<TARGET_GROUP_ARN>,containerName=relays-backend,containerPort=3000 \
  --health-check-grace-period-seconds 60 \
  --deployment-configuration "maximumPercent=200,minimumHealthyPercent=100" \
  --enable-execute-command
```

## Step 8: Configure Auto Scaling

### Create Auto Scaling Target
```bash
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/relays-cluster/relays-backend \
  --min-capacity 2 \
  --max-capacity 10
```

### Create Scaling Policy (Target Tracking)
```bash
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/relays-cluster/relays-backend \
  --policy-name cpu-target-tracking-policy \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration file://scaling-policy.json
```

## Step 9: Set Up Route 53

### Create Hosted Zone
```bash
aws route53 create-hosted-zone \
  --name relays.social \
  --caller-reference $(date +%s)
```

### Create A Record (Alias to ALB)
```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id <HOSTED_ZONE_ID> \
  --change-batch file://a-record-change-batch.json
```

## Step 10: Run Database Migrations

### Connect to RDS via Bastion or ECS Exec
```bash
# Option 1: Via ECS Exec
aws ecs execute-command \
  --cluster relays-cluster \
  --task <TASK_ID> \
  --container relays-backend \
  --interactive \
  --command "/bin/sh"

# Then run migrations
PGPASSWORD=$DB_PASSWORD psql -h <RDS_ENDPOINT> -U relayhub_admin -d relayhub -f migrations/001_initial.sql
# Run all other migrations...
```

## Environment Variables

Create SSM Parameter Store entries:
```bash
aws ssm put-parameter --name /relays/DATABASE_URL --value "postgresql://..." --type SecureString
aws ssm put-parameter --name /relays/REDIS_URL --value "redis://..." --type SecureString
aws ssm put-parameter --name /relays/AWS_ACCESS_KEY_ID --value "..." --type SecureString
aws ssm put-parameter --name /relays/AWS_SECRET_ACCESS_KEY --value "..." --type SecureString
aws ssm put-parameter --name /relays/CLOUDFLARE_R2_BUCKET --value "..." --type SecureString
```

## Monitoring and Logging

### Enable CloudWatch Logs
Already configured in task definition with log driver awslogs.

### Create CloudWatch Dashboard
```bash
aws cloudwatch put-dashboard \
  --dashboard-name relays-social \
  --dashboard-body file://cloudwatch-dashboard.json
```

### Set Up Alarms
```bash
# High CPU alarm
aws cloudwatch put-metric-alarm \
  --alarm-name relays-high-cpu \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

# Database connections alarm
aws cloudwatch put-metric-alarm \
  --alarm-name relays-db-connections \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold
```

## Cost Optimization

### Estimated Monthly Costs (assuming moderate traffic)
- **ECS Fargate** (2 tasks, 0.5 vCPU, 1GB RAM): ~$30
- **RDS PostgreSQL** (db.t4g.micro): ~$15
- **ElastiCache Redis** (cache.t4g.micro): ~$12
- **Application Load Balancer**: ~$20
- **Data Transfer**: ~$10-50 (varies)
- **CloudFront**: ~$5-20 (varies)

**Total**: ~$92-147/month

### Savings Tips
1. Use Fargate Spot for non-critical tasks (70% savings)
2. Enable RDS Reserved Instances for 1-year commit (40% savings)
3. Use S3 Intelligent-Tiering for media
4. Enable CloudFront compression
5. Use Aurora Serverless v2 for variable workloads

## Security Checklist

- [x] All services in private subnets
- [x] Security groups restrict access
- [x] RDS encryption at rest enabled
- [x] SSL/TLS certificates via ACM
- [x] Secrets in SSM Parameter Store
- [x] IAM roles follow least privilege
- [x] CloudWatch logging enabled
- [x] Enable AWS WAF on ALB
- [x] Enable GuardDuty for threat detection
- [x] Regular automated backups

## CI/CD Pipeline (GitHub Actions)

See `.github/workflows/deploy.yml` for automated deployment pipeline.

## Useful Commands

### View ECS Service Status
```bash
aws ecs describe-services --cluster relays-cluster --services relays-backend
```

### View Logs
```bash
aws logs tail /ecs/relays-backend --follow
```

### Scale Service
```bash
aws ecs update-service --cluster relays-cluster --service relays-backend --desired-count 4
```

### Deploy New Version
```bash
# Build and push new image
# Then update service to force new deployment
aws ecs update-service --cluster relays-cluster --service relays-backend --force-new-deployment
```

## Troubleshooting

### Service Won't Start
- Check CloudWatch logs
- Verify environment variables in task definition
- Check security group rules
- Verify RDS/Redis connectivity

### High Latency
- Check RDS performance insights
- Review Redis hit rate
- Analyze ALB metrics
- Check CloudFront cache hit rate

### Database Connection Errors
- Check RDS security group
- Verify connection string
- Check max_connections parameter
- Review active connections in RDS

## Support

For issues, contact: support@relays.social
Documentation: https://docs.relays.social
