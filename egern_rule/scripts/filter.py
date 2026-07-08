import urllib.request
import os

SOURCE_URL = "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/QuantumultX/Global/Global.list"
OUTPUT_PATH = "rule/Global.list"

IP_PREFIXES = ("IP-CIDR,", "IP-CIDR6,", "GEOIP,", "IP6-CIDR,")

def main():
    with urllib.request.urlopen(SOURCE_URL) as resp:
        lines = resp.read().decode("utf-8").splitlines()

    filtered = []
    removed = 0
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            filtered.append(line)
            continue
        if any(stripped.upper().startswith(p) for p in IP_PREFIXES):
            removed += 1
            continue
        filtered.append(line)

    os.makedirs("rule", exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(filtered) + "\n")

    print(f"完成：保留 {len(filtered)} 行，过滤掉 {removed} 条 IP 规则")

if __name__ == "__main__":
    main()
