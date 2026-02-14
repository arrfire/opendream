import { discoverAudience as discoverAiAudience, generateReply, generateSearchKeywords } from './gemini';
import { addLeads, getProject, Project, Lead } from './db';
import { discoverSocialLeads, SocialLead } from './social-data';

export async function discoverAndSaveLeads(projectId: string): Promise<Lead[]> {
    const project = getProject(projectId);
    if (!project) {
        throw new Error('Project not found');
    }

    // 1. Get AI Personas/Leads (Simulated)
    const aiResult = await discoverAiAudience(project.name, project.vision);

    // 2. Get Real Social Leads
    // Use AI to generate relevant search keywords based on problem/vision
    const searchKeywords = await generateSearchKeywords(project.name, project.vision);

    // Fallback if AI fails to generate keywords
    if (searchKeywords.length === 0) {
        const visionKeywords = project.vision.split(' ')
            .filter((w: string) => w.length > 4)
            .slice(0, 2);
        searchKeywords.push(project.name, ...visionKeywords);
    }

    console.log(`Searching social media with keywords: ${searchKeywords.join(', ')}`);
    const socialResult = await discoverSocialLeads(projectId, searchKeywords);

    // 3. Merge & Format
    const socialLeadsFormatted = await Promise.all(socialResult.map(async (lead: SocialLead) => {
        // Generate a context-aware reply for social leads
        const suggestedReply = await generateReply(
            project.name,
            project.vision,
            lead.name,
            lead.lastInteraction, // treating interaction as pain point/context
            []
        );

        return {
            projectId,
            name: lead.name,
            platform: lead.platform,
            profileUrl: lead.profileUrl,
            painPoint: `Detected via ${lead.platform} interaction: ${lead.lastInteraction}`,
            status: 'discovered' as const,
            lastMessage: suggestedReply, // Pre-fill the reply
            conversations: [
                {
                    role: 'ai' as const,
                    message: `Found via ${lead.platform}. ${lead.lastInteraction}`,
                    timestamp: new Date().toISOString(),
                },
                {
                    role: 'ai' as const,
                    message: suggestedReply, // Add draft to history
                    timestamp: new Date().toISOString(),
                }
            ],
            metadata: {
                sourceId: lead.sourceId,
                isSimulated: false
            },
        };
    }));

    const aiLeadsFormatted = aiResult.leads.map(lead => ({
        projectId,
        name: lead.name,
        platform: lead.platform,
        profileUrl: lead.profileUrl,
        painPoint: lead.painPoint,
        status: 'discovered' as const,
        lastMessage: lead.suggestedReply,
        conversations: [
            {
                role: 'ai' as const,
                message: lead.suggestedReply,
                timestamp: new Date().toISOString(),
            },
        ],
        metadata: {
            isSimulated: true // Mark as simulated so we don't try to reply via API
        }
    }));

    // Cast to Lead (some properties might strictly match Lead interface in db.ts)
    // The structure above matches Omit<Lead, 'id' | 'discoveredAt'>

    const allLeads = [...socialLeadsFormatted, ...aiLeadsFormatted];
    const saved = addLeads(allLeads);

    return saved;
}
