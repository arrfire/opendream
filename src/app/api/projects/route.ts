import { NextRequest, NextResponse } from 'next/server';
import { createProject, getProjects, updateProject } from '@/lib/db';

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        const project = updateProject(id, updates);
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        return NextResponse.json(project);
    } catch (error) {
        console.error('Error updating project:', error);
        return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, logo, vision, githubUrl, agentFrequency, targetLanguages } = body;

        if (!name || !vision || !githubUrl) {
            return NextResponse.json(
                { error: 'Name, vision, and GitHub URL are required' },
                { status: 400 }
            );
        }

        const project = createProject({
            name,
            logo: logo || '',
            vision,
            githubUrl,
            agentFrequency: agentFrequency || 24,
            targetLanguages: targetLanguages || []
        });
        return NextResponse.json(project, { status: 201 });
    } catch (error) {
        console.error('Error creating project:', error);
        return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const projects = getProjects();
        return NextResponse.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }
}
