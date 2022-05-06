/* Copyright © 2021 Exact Realty Limited.
 *
 * All rights reserved.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */

module.exports = (grunt) => {
	grunt.initConfig({
		browserify: {
			dist: {
				files: {
					'dist/app.js': ['./src/**/*.ts'],
				},
				options: {
					plugin: [
						'tsify',
						process.env.NODE_ENV === 'production' ? 'tinyify' : '',
					].filter((p) => !!p),
					transform: [],
					browserifyOptions: {
						node: true,
						debug: true,
					},
				},
			},
		},
		exorcise: {
			dist: {
				options: {},
				files: {
					'dist/app.js.map': ['dist/app.js'],
				},
			},
		},
	});

	grunt.loadNpmTasks('grunt-browserify');
	grunt.loadNpmTasks('@exact-realty/grunt-exorcise');
	grunt.registerTask('default', ['browserify:dist', 'exorcise:dist']);
};
