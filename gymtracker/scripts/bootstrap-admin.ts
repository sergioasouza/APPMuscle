import {
  createServiceRoleSupabaseClient,
  getArgumentValue,
  loadLocalEnvFiles,
} from "./lib/supabase-script-support";

async function main() {
  loadLocalEnvFiles();

  const email = (getArgumentValue("--email") ?? "").trim().toLowerCase();
  const password = (getArgumentValue("--password") ?? "").trim();
  const displayName = (getArgumentValue("--name") ?? "Admin GymTracker").trim();

  if (!email) {
    throw new Error("Use --email admin@dominio.com");
  }

  if (!password || password.length < 8) {
    throw new Error("Use --password com pelo menos 8 caracteres");
  }

  const supabase = createServiceRoleSupabaseClient();
  const existingUsers = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 500,
  });

  if (existingUsers.error) {
    throw new Error(existingUsers.error.message);
  }

  const existingUser = existingUsers.data.users.find(
    (user) => user.email?.toLowerCase() === email,
  );

  let userId = existingUser?.id;

  if (!userId) {
    const createResult = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
      },
    });

    if (createResult.error || !createResult.data.user) {
      throw new Error(createResult.error?.message ?? "Unable to create admin");
    }

    userId = createResult.data.user.id;
  } else {
    const updateResult = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
      },
    });

    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      display_name: displayName,
      role: "admin",
      access_status: "active",
      paid_until: null,
      must_change_password: false,
      created_by_admin_id: null,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    actor_user_id: userId,
    target_user_id: userId,
    entity_type: "system",
    entity_id: userId,
    action: "admin.bootstrap",
    metadata: {
      email,
      displayName,
    },
  });

  if (auditError) {
    throw new Error(auditError.message);
  }

  console.log(`Admin pronto: ${email} (${userId})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
