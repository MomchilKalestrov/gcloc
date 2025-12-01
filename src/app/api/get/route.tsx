import { type NextRequest, NextResponse } from 'next/server';
import formats from './formats.json';
import colors from './colors.json';
//@ts-ignore
import font from './font.ttf';
import AdmZip from 'adm-zip';
import satori from 'satori';

declare global {
    var repos: Map<string, {
        date: number;
        value: Record<string, bigint>;
    }>;
};

if (!globalThis.repos)
    globalThis.repos = new Map();

export const runtime = 'nodejs';

const filterFiles = (files: AdmZip.IZipEntry[], rootDir: string): AdmZip.IZipEntry[] =>
    files.filter(({ entryName, isDirectory }) =>
        entryName.split('/')[ 1 ].startsWith(rootDir) && !isDirectory
    );

const countLines = (archive: AdmZip, rootDir: string): Record<string, bigint> => {
    const files = filterFiles(archive.getEntries(), rootDir);
    let counters: Record<string, bigint> = {};

    for (const file of files) {
        const language = (formats as any)[ file.entryName.split('.').pop()! ] || 'Unknown';
        if (counters[ language ] === undefined)
            counters[ language ] = BigInt(0);
        
        const data = archive.readAsText(file);
        counters[ language ] += BigInt(data.match(/\n/g)?.length ?? 1);
    };
    
    return counters;
};

const GET = async (request: NextRequest) => {
    const { searchParams } = request.nextUrl;
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const ref = searchParams.get('ref');
    const rootDir = searchParams.get('rootDir');
    
    if (!owner || !repo)
        return new NextResponse(null, {
            status: 400
        });

    let lineCount: Record<string, bigint> = {};

    const data = global.repos.get(`${ owner }/${ repo }`);
    if (data && (Date.now() - data.date) < 1000 * 60 * 60 * 24)
        lineCount = data.value;
    else
        try {
            const response = await fetch(`https://api.github.com/repos/${ owner }/${ repo }/zipball${ ref ? '/' + ref : '' }`, {
                headers: {
                    'X-GitHub-Api-Version': '2022-11-28',
                    'Accept': 'application/vnd.github+json'
                }
            });
            
            const archive = new AdmZip(Buffer.from(await response.arrayBuffer()));
            lineCount = countLines(archive, rootDir || '');
        } catch (error) {
            console.log('Error: ' + error);
            return new NextResponse(null, {
                status: 500
            });
        };
    
    global.repos.set(`${ owner }/${ repo }`, {
        date: Date.now(),
        value: lineCount
    });

    const totalLineCount =
        Object
            .values(lineCount)
            .reduce<number>((acc, cur) => 
                Number(cur) + acc
            , 0);
    
    const percentages = 
        Object
            .entries(lineCount)
            .reduce<Record<string, number>>((acc, [ key, value ]) => {
                acc[ key ] = Number(value) / totalLineCount * 100;
                return acc;
            }, {});
    
    const svg = await satori(
        <div style={ {
            display: 'flex',
            backgroundColor: '#212830',
            borderRadius: '0.375rem',
            border: '1px solid #3d444d',
            padding: '0.5rem',
            width: '100%',
            flexDirection: 'column',
            gap: '0.25rem'
        } }>
            <p style={ {
                fontFamily: 'Roboto',
                margin: '0px',
                color: 'white',
                lineHeight: '1rem',
                fontSize: '1rem'
            } }>{ totalLineCount }</p>
            <p style={ {
                fontFamily: 'Roboto',
                margin: '0px',
                color: '#9198a1',
                lineHeight: '0.75rem',
                fontSize: '0.75rem'
            } }>lines of code</p>
            <div style={ {
                marginTop: '2px',
                height: '0.75rem',
                display: 'flex',
                gap: '1px'
            } }>
                { Object.entries(percentages).map(([ language, percentages ], index) =>
                    <div
                        key={ language }
                        style={ {
                            width: `${ Math.round(percentages).toString() }%`,
                            height: '100%',
                            borderRadius: '2px',
                            backgroundColor:
                                language === 'Unknown'
                                ?   '#555555'
                                :   colors[ index % (colors.length - 1) ]
                        } }
                    />
                ) }
            </div>
            <div style={ {
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
            } }>
                { Object.keys(percentages).map((language, index) =>
                    <div
                        key={ language }
                        style={ {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                        } }
                    >
                        <div
                            style={ {
                                width: `0.5rem`,
                                height: '0.5rem',
                                borderRadius: '0.25rem',
                                backgroundColor:
                                    language === 'Unknown'
                                    ?   '#555555'
                                    :   colors[ index % (colors.length - 1) ]
                            } }
                        />
                        <p style={ {
                            fontFamily: 'Roboto',
                            margin: '0px',
                            color: 'white',
                            lineHeight: '0.75rem',
                            fontSize: '0.75rem'
                        } }>{ language }</p>
                        <p style={ {
                            fontFamily: 'Roboto',
                            margin: '0px',
                            color: '#9198a1',
                            lineHeight: '0.75rem',
                            fontSize: '0.75rem'
                        } }>{ lineCount[ language ] }</p>
                    </div>
                ) }
            </div>
        </div>,
        {
            width: 600,
            height: 400,
            fonts: [
                {
                    name: 'Roboto',
                    data: font
                }
            ]
        }
    );

    return new NextResponse(svg, {
        headers: {
            'Content-Type': 'image/svg+xml'
        }
    })
};

export { GET };