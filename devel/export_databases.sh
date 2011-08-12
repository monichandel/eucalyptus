
# Usage: export_database.sh databaseName databaseName...

openssl pkcs12 -in ${EUCALYPTUS}/var/lib/eucalyptus/keys/euca.p12 \
-name eucalyptus -name "eucalyptus" \
-password pass:eucalyptus  -passin pass:eucalyptus -passout pass:eucalyptus \
-nodes | \
grep -A30 "friendlyName: eucalyptus" | \
egrep -A27 "BEGIN (RSA|PRIVATE)" | grep -v 'Bag Attributes' > ${EUCALYPTUS}/var/lib/eucalyptus/keys/cloud-pk.pem

PASS=$($(dirname $(readlink -f $0))/dbPass.sh)

for xx in ${@}; do echo "connect $xx"; mysqldump -u eucalyptus --password=${PASS} --port=8777 --protocol=TCP $xx; done
