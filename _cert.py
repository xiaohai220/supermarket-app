import paramiko
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("43.128.10.238",22,"ubuntu","Xh137465",timeout=25)
cmd = "sudo certbot certonly --webroot -w /home/ubuntu/supermarket-app -d xxhrcs.com -d www.xxhrcs.com --non-interactive --agree-tos -m admin@xxhrcs.com 2>&1 | tail -25"
i,o,e=c.exec_command(cmd,timeout=120)
print(o.read().decode(), e.read().decode())
c.close()
