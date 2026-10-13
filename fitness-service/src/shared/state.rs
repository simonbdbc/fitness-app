use std::sync::Arc;

use sqlx::PgPool;

use crate::features::ai::BurnWeeklyProgramGenerator;
use crate::shared::config::AppConfig;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub _config: AppConfig,
    pub weekly_program_generator: Arc<BurnWeeklyProgramGenerator>,
}

impl AppState {
    pub fn new(pool: PgPool, config: AppConfig) -> Self {
        Self {
            pool,
            _config: config,
            weekly_program_generator: Arc::new(BurnWeeklyProgramGenerator::new()),
        }
    }
}
