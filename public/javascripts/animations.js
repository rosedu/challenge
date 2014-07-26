
$('#remove_account').on("click", function () {
  if (confirm("Are you sure you want to remove your account and all associated"
              + " content? This action cannot be undone.")) {

    // Compose 
    var index = window.location.pathname.indexOf('/', 1)
    var win_url = window.location.pathname.substring(1, index)
    window.location.replace('../' + win_url + '/remove')

  } else {
    return false
  }
});
</script>