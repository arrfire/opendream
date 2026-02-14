// Run with: npx tsx scripts/agent-runner.ts
import { runAgentCycle } from '../src/lib/agent';
import { getProjects, getProject } from '../src/lib/db';

const POLL_INTERVAL_MS = 15 * 60 * 1000; // Check every 15 minutes

async function main() {
    const args = process.argv.slice(2);
    const specificProjectId = args[0];

    if (specificProjectId) {
        console.log(`[Runner] Starting dedicated mode for Project: ${specificProjectId}`);
        // In dedicated mode, we just run immediately and then follow interval
        await runCycleSafe(specificProjectId);
        setInterval(async () => {
            await runCycleSafe(specificProjectId);
        }, POLL_INTERVAL_MS);
        return;
    }

    console.log(`[Runner] Starting Global Autonomous Mode`);
    console.log(`[Runner] Polling interval: 15 minutes`);

    // Initial check
    await checkAndRunProjects();

    // Loop
    setInterval(async () => {
        await checkAndRunProjects();
    }, POLL_INTERVAL_MS);
}

async function checkAndRunProjects() {
    const projects = getProjects();
    const now = new Date();

    console.log(`[Runner] [${now.toISOString()}] Checking ${projects.length} projects...`);

    for (const project of projects) {
        const baseTime = project.lastRun ? new Date(project.lastRun) : new Date(project.createdAt);
        const frequencyMs = project.agentFrequency * 60 * 60 * 1000;
        const nextRun = new Date(baseTime.getTime() + frequencyMs);

        if (now >= nextRun) {
            console.log(`[Runner] Project "${project.name}" is DUE (Last run: ${project.lastRun || 'Never'})`);
            await runCycleSafe(project.id);
        } else {
            const waitHours = ((nextRun.getTime() - now.getTime()) / (1000 * 60 * 60)).toFixed(2);
            console.log(`[Runner] Project "${project.name}" skipping. Next run in ${waitHours} hours.`);
        }
    }
}

async function runCycleSafe(projectId: string) {
    const project = getProject(projectId);
    if (!project) return;

    console.log(`\n--- [${new Date().toISOString()}] Starting Cycle: ${project.name} ---`);
    try {
        const result = await runAgentCycle(projectId);
        console.log(`[${project.name}] Content: ${result.contentGenerated}, Images: ${result.imagesGenerated}, Posts: ${result.postsPublished}`);
        console.log(`[${project.name}] Leads Discovered: ${result.leadsDiscovered}, Engaged: ${result.leadsEngaged}`);
        if (result.errors.length > 0) {
            console.error(`[${project.name}] Errors:`, result.errors);
        }
    } catch (err) {
        console.error(`[${project.name}] CRITICAL RUNNER ERROR:`, err);
    }
    console.log(`--- [${project.name}] Cycle End ---`);
}

main();
