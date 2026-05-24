// Netlify Function: add-client
// Receives form submission from onboarding.html → adds client to pinterest_clients.json in GitHub

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO  = process.env.GITHUB_REPO  || 'JaneSwiss/clients-dashboard';
const GITHUB_FILE  = process.env.GITHUB_FILE  || 'pinterest_clients.json';
const API_URL      = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: 'Method not allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  try {
    const getRes = await fetch(API_URL, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' },
    });
    if (!getRes.ok) throw new Error(`GitHub GET failed: ${getRes.status}`);
    const fileMeta = await getRes.json();
    const sha = fileMeta.sha;
    const currentData = JSON.parse(Buffer.from(fileMeta.content, 'base64').toString('utf8'));

    const clients = currentData.clients || [];
    const id = 'client_' + String(clients.length + 1).padStart(3, '0');
    const today = new Date().toISOString().split('T')[0];

    let uploadedFiles = [];
    try { uploadedFiles = JSON.parse(body.uploaded_files || '[]'); } catch {}

    const newClient = {
      id,
      name:          body.business_name || 'New Client',
      business_name: body.business_name || '',
      email:         body.client_email  || '',
      package:       body.package       || 'package_1',
      date_signed:   today,
      status:        'questionnaire_received',
      questionnaire: {
        urls:                   body.urls                   || '',
        what_they_sell:         body.what_they_sell         || '',
        target_audience:        body.target_audience        || '',
        pinterest_goal:         body.pinterest_goal         || '',
        hero_product:           body.hero_product           || '',
        has_pinterest:          body.has_pinterest === 'yes',
        pinterest_url:          body.pinterest_url          || '',
        pinterest_email:        body.pinterest_email        || '',
        pinterest_password:     body.pinterest_password ? '[see email notification]' : '',
        pinterest_create_email: body.pinterest_create_email || '',
        content_drive_link:     body.content_drive_link     || '',
        content_uploaded_files: uploadedFiles,
        brand_colors:           body.brand_colors           || '',
        fonts:                  body.fonts                  || '',
        logo_url:               body.logo_url               || '',
        template_preferences:   body.template_preferences   || '',
        avoid:                  body.avoid                  || '',
        extra_notes:            body.extra_notes            || '',
      },
      deliverables: {
        niche_audit: false, competitor_analysis: false, keyword_research: false,
        pin_design_guidance: false, content_gap_analysis: false, strategy_document: false,
        pin_templates_50: false, business_account_setup: false, website_claiming: false,
        account_branding: false, profile_seo: false, boards_created_10: false,
        pins_created_50: false, pins_scheduled: false,
      },
      files: {},
      notes: '',
    };

    clients.push(newClient);
    currentData.clients = clients;

    const updatedContent = Buffer.from(JSON.stringify(currentData, null, 2)).toString('base64');
    const putRes = await fetch(API_URL, {
      method: 'PUT',
      headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Add client: ${newClient.business_name} (${newClient.package})`, content: updatedContent, sha }),
    });
    if (!putRes.ok) throw new Error(`GitHub PUT failed: ${putRes.status}`);

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, id }) };

  } catch (err) {
    console.error('add-client error:', err.message);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
