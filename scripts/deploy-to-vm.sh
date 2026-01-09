#!/bin/bash
# Deploy Claudia Coder to test VM
# Usage: ./scripts/deploy-to-vm.sh [vm-ip]

VM_IP="${1:-192.168.245.211}"
VM_USER="bill"
REMOTE_DIR="/home/bill/claudia-coder"

echo "Deploying Claudia Coder to $VM_USER@$VM_IP..."

# 1. Create remote directory
ssh $VM_USER@$VM_IP "mkdir -p $REMOTE_DIR"

# 2. Copy docker files
scp -r docker/* $VM_USER@$VM_IP:$REMOTE_DIR/

# 3. Copy necessary scripts
scp scripts/create-default-admin.js $VM_USER@$VM_IP:$REMOTE_DIR/

# 4. Run installation on VM
ssh $VM_USER@$VM_IP "cd $REMOTE_DIR && chmod +x install.sh && ./install.sh"

echo "Deployment complete!"
echo "Access Claudia Coder at: https://$VM_IP:3000"
