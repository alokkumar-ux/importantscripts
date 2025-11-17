import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

/**
 * Generates SSH key + config alias inside:
 *   Windows → D:\klarion6-0\ws\shared_ssh
 *   Linux   → /nfs/ws/shared_ssh
 *
 * Fully user-independent (no reliance on ~/.ssh)
 */
async function generateSharedSSHKey(alias, provider) {
	try {
		if (!alias || !provider) {
			console.error("ERROR: Usage: node sshkey.js <alias> <provider>");
			console.error("Example: node sshkey.js procify_github github");
			console.error("Providers: github | bitbucket");
			process.exit(1);
		}

		const providerNormalized = provider.toLowerCase();
		const hostMap = { github: "github.com", bitbucket: "bitbucket.org" };
		const hostName = hostMap[providerNormalized];
		if (!hostName) throw new Error("Invalid provider. Use github or bitbucket.");

		// Fixed shared SSH directory (independent of user)
		const baseDir = process.platform === "win32" ? "D:\\klarion6.0\\ws" : "/nfs/ws";
		const sharedSSHDir = path.join(baseDir, "shared_ssh");

		if (!fs.existsSync(sharedSSHDir)) {
			fs.mkdirSync(sharedSSHDir, { recursive: true });
			console.log(`INFO: Created shared SSH folder: ${sharedSSHDir}`);
		}

		const keyName = `id_ed25519_${providerNormalized}_${alias}`;
		const privateKeyPath = path.join(sharedSSHDir, keyName);
		const publicKeyPath = `${privateKeyPath}.pub`;
		const configPath = path.join(sharedSSHDir, "config");
		const knownHostsPath = path.join(sharedSSHDir, "known_hosts");

		// Generate SSH key if not exists
		if (!fs.existsSync(privateKeyPath)) {
			console.log(`INFO: Generating SSH key for ${providerNormalized}: ${keyName}`);
			execSync(`ssh-keygen -t ed25519 -f "${privateKeyPath}" -C "${alias}" -N ""`, { stdio: "inherit" });
		}

		// Trusted host fingerprints
		const trustedHosts = [
			"github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl",
			"bitbucket.org ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDQeJzhupRu0u0cdegZIa8e86EG2qOCsIsD1Xw0xSeiPDlCr7kq97NLmMbpKTX6Esc30NuoqEEHCuc7yWtwp8dI76EEEB1VqY9QJq6vk+aySyboD5QF61I/1WeTwu+deCbgKMGbUijeXhtfbxSxm6JwGrXrhBdofTsbKRUsrN1WoNgUa8uqN1Vx6WAJw1JHPhglEGGHea6QICwJOAr/6mrui/oB7pkaWKHj3z7d1IC4KWLtY47elvjbaTlkN04Kc/5LFEirorGYVbt15kAUlqGM65pk6ZBxtaO3+30LVlORZkxOh+LKL/BvbZ/iRNhItLqNyieoQj/uh/7Iv4uyH/cV/0b4WDSd3DptigWq84lJubb9t/DnZlrJazxyDCulTmKdOR7vs9gMTo+uoIrPSb8ScTtvw65+odKAlBj59dhnVp9zd7QUojOpXlL62Aw56U4oO+FALuevvMjiWeavKhJqlR7i5n9srYcrNV7ttmDw7kf/97P5zauIhxcjX+xHv4M=",
		];

		// Create known_hosts if missing
		if (!fs.existsSync(knownHostsPath)) {
			fs.writeFileSync(knownHostsPath, trustedHosts.join("\n") + "\n", { mode: 0o600 });
			console.log(`INFO: Created known_hosts: ${knownHostsPath}`);
		}

		// Base host entry (for git@bitbucket.org)
		const baseBlock = `
Host ${hostName}
    HostName ${hostName}
    User git
    IdentityFile ${privateKeyPath}
    IdentitiesOnly yes
    UserKnownHostsFile ${knownHostsPath}
    GlobalKnownHostsFile ${knownHostsPath}
`;

		// Alias entry (for git@bitbucket.org-alias)
		const aliasBlock = `
Host ${hostName}-${alias}
    HostName ${hostName}
    User git
    IdentityFile ${privateKeyPath}
    IdentitiesOnly yes
    UserKnownHostsFile ${knownHostsPath}
    GlobalKnownHostsFile ${knownHostsPath}
`;

		let configContent = "";
		if (fs.existsSync(configPath)) configContent = fs.readFileSync(configPath, "utf8");

		// Add base host if missing
		if (!configContent.includes(`Host ${hostName}`)) {
			fs.appendFileSync(configPath, baseBlock);
			console.log(`INFO: Added base host: ${hostName}`);
		}

		// Add alias if missing
		if (!configContent.includes(`Host ${hostName}-${alias}`)) {
			fs.appendFileSync(configPath, aliasBlock);
			console.log(`INFO: Added alias: ${hostName}-${alias}`);
		}

		console.log(`\nSUCCESS: SSH setup complete for ${providerNormalized.toUpperCase()}`);
		console.log(`Folder       : ${sharedSSHDir}`);
		console.log(`Private Key  : ${privateKeyPath}`);
		console.log(`Public Key   : ${publicKeyPath}`);
		console.log(`Config File  : ${configPath}`);
		console.log(`Known Hosts  : ${knownHostsPath}`);
		console.log(`\nUsage for cloning:\n git clone git@${hostName}-${alias}:<org>/<repo>.git`);
	} catch (err) {
		console.error(`ERROR: SSH setup failed: ${err.message}`);
		process.exit(1);
	}
}

const [,, aliasArg, providerArg] = process.argv;
generateSharedSSHKey(aliasArg, providerArg);
