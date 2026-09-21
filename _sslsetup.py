import paramiko, time
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("43.128.10.238",22,"ubuntu","Xh137465",timeout=25)
def run(cmd,t=120):
    i,o,e=c.exec_command(cmd,timeout=t)
    try: out=o.read().decode(); err=e.read().decode()
    except Exception: out="(timeout)"; err=""
    return out,err
for cmd in [
  "sudo apt-get install -y certbot >/tmp/cb.log 2>&1; certbot --version",
  "mkdir -p ~/supermarket-app/.well-known/acme-challenge && echo ok",
]:
    o,e=run(cmd,180); print("$",cmd,"\n",o[-500:], e[-300:])
c.close()
