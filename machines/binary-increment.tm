# Increment an unsigned binary number by one.
start scan
halt done
blank _

scan 0 -> scan 0 R
scan 1 -> scan 1 R
scan _ -> carry _ L
carry 0 -> done 1 S
carry 1 -> carry 0 L
carry _ -> done 1 S
